/* Panorama Personal <-> Panorama Café Core
   Una sola responsabilidad: sincronizar estado y pagos con Supabase.
   La interfaz decide cómo aplicar y renderizar cambios remotos.
*/
(function(){
  const cfg=window.PANORAMA_SUPABASE;
  const STORE='panorama_cafe_personal_v1';
  const ROW_ID='personal-main';
  if(!cfg?.url||!cfg?.key){console.warn('Panorama Core: falta configuración Supabase');return;}

  const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
  let pushing=false,pushTimer=null,lastRemoteUpdatedAt=null,applyingRemote=false,realtime=null;

  function readLocal(){try{return JSON.parse(localStorage.getItem(STORE)||'null');}catch{return null;}}
  function writeLocal(data){applyingRemote=true;try{localStorage.setItem(STORE,JSON.stringify(data));}finally{applyingRemote=false;}}

  async function publishPayments(data){
    const payments=Array.isArray(data?.payments)?data.payments:[];
    const employees=new Map((Array.isArray(data?.employees)?data.employees:[]).map(e=>[String(e.id),e]));
    const activeIds=new Set(payments.filter(p=>p?.id).map(p=>String(p.id)));
    const existing=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?source=eq.personal&select=id',{headers});
    if(!existing.ok)throw new Error(await existing.text());
    for(const row of (await existing.json()||[])){
      if(activeIds.has(String(row.id)))continue;
      const del=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?id=eq.'+encodeURIComponent(row.id)+'&source=eq.personal',{method:'DELETE',headers:{...headers,Prefer:'return=minimal'}});
      if(!del.ok)throw new Error(await del.text());
    }
    for(const p of payments){
      if(!p?.id||!p?.employeeId||!Number.isFinite(Number(p.amount)))continue;
      const employee=employees.get(String(p.employeeId))||{};
      const body={id:String(p.id),source:'personal',employee_id:String(p.employeeId),employee_name:String(employee.name||p.employeeName||''),amount:Number(p.amount),paid_date:String(p.paidDate||new Date().toISOString().slice(0,10)).slice(0,10),period_start:p.periodStart?String(p.periodStart).slice(0,10):null,period_end:p.periodEnd?String(p.periodEnd).slice(0,10):null,note:String(p.note||''),account:p.account?String(p.account):null,updated_at:new Date().toISOString()};
      const upsert=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?on_conflict=id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});
      if(!upsert.ok)throw new Error(await upsert.text());
    }
  }

  async function push(){
    if(pushing||applyingRemote)return;
    const data=readLocal();if(!data)return;
    pushing=true;
    try{
      const response=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW_ID),{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({data})});
      if(!response.ok)throw new Error(await response.text());
      const rows=await response.json();
      lastRemoteUpdatedAt=rows?.[0]?.updated_at||lastRemoteUpdatedAt;
      await publishPayments(data);
      window.dispatchEvent(new CustomEvent('panorama-core-personal-synced'));
    }catch(error){console.warn('Panorama Core: no se pudo sincronizar Personal',error);}
    finally{pushing=false;}
  }

  function schedulePush(){
    if(applyingRemote)return;
    clearTimeout(pushTimer);pushTimer=setTimeout(push,250);
  }

  async function pull(initial=false){
    if(pushing)return false;
    try{
      const response=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW_ID)+'&select=data,updated_at',{headers,cache:'no-store'});
      if(!response.ok)throw new Error(await response.text());
      const row=(await response.json())?.[0];
      if(!row?.data)return false;
      if(row.updated_at===lastRemoteUpdatedAt)return false;
      const current=readLocal();lastRemoteUpdatedAt=row.updated_at;
      if(JSON.stringify(current)===JSON.stringify(row.data))return false;
      writeLocal(row.data);
      window.dispatchEvent(new CustomEvent('panorama-core-personal-remote-update',{detail:{data:row.data,updatedAt:row.updated_at,initial}}));
      return true;
    }catch(error){console.warn('Panorama Core: no se pudo leer estado remoto',error);return false;}
  }

  function startRealtime(){
    if(realtime||!window.supabase?.createClient)return;
    try{
      const client=window.supabase.createClient(cfg.url,cfg.key);
      realtime=client.channel('panorama-personal-state')
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'panorama_personal_state',filter:'id=eq.'+ROW_ID},payload=>{
          if(payload?.new?.updated_at===lastRemoteUpdatedAt)return;
          pull(false);
        })
        .subscribe(status=>{if(status==='SUBSCRIBED')console.info('Panorama Personal: Realtime conectado');});
    }catch(error){console.warn('Panorama Personal: no se pudo iniciar Realtime',error);}
  }

  const originalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    const result=originalSetItem.apply(this,arguments);
    if(this===localStorage&&key===STORE&&!applyingRemote)schedulePush();
    return result;
  };

  window.PanoramaCore={
    syncNow:push,
    pullNow:()=>pull(false),
    paymentStatus:async(periodId,employeeId)=>{
      const url=cfg.url+'/rest/v1/payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(String(periodId))+'&employee_id=eq.'+encodeURIComponent(String(employeeId))+'&select=id,status,amount,period_start,period_end';
      const response=await fetch(url,{headers});if(!response.ok)throw new Error(await response.text());return response.json();
    }
  };

  window.addEventListener('load',async()=>{
    await pull(true);
    await push();
    startRealtime();
    window.dispatchEvent(new Event('panorama-core-personal-ready'));
  });
})();