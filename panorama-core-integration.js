/* Panorama Personal <-> Panorama Café Core
   Sincronización única del estado real de la app.
   - Conserva localStorage como almacenamiento inmediato.
   - Publica el estado completo en panorama_personal_state.
   - Recupera cambios de otros dispositivos.
   - Core normaliza empleados, jornadas y pagos mediante trigger.
*/
(function(){
  const cfg=window.PANORAMA_SUPABASE;
  const STORE='panorama_cafe_personal_v1';
  const ROW_ID='personal-main';
  if(!cfg?.url||!cfg?.key){console.warn('Panorama Core: falta configuración Supabase');return;}

  const headers={'apikey':cfg.key,'Authorization':'Bearer '+cfg.key,'Content-Type':'application/json'};
  let pushing=false, pullTimer=null, lastRemoteUpdatedAt=null, applyingRemote=false;

  function readLocal(){
    try{return JSON.parse(localStorage.getItem(STORE)||'null');}catch{return null;}
  }
  function writeLocal(data){
    applyingRemote=true;
    try{localStorage.setItem(STORE,JSON.stringify(data));}
    finally{setTimeout(()=>applyingRemote=false,0);}
  }
  async function push(){
    if(pushing||applyingRemote)return;
    const data=readLocal(); if(!data)return;
    pushing=true;
    try{
      const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW_ID),{
        method:'PATCH',headers:{...headers,'Prefer':'return=representation'},
        body:JSON.stringify({data})
      });
      if(!r.ok) throw new Error(await r.text());
      const rows=await r.json();
      lastRemoteUpdatedAt=rows?.[0]?.updated_at||lastRemoteUpdatedAt;
      window.dispatchEvent(new CustomEvent('panorama-core-personal-synced'));
    }catch(e){console.warn('Panorama Core: no se pudo sincronizar Personal',e);}
    finally{pushing=false;}
  }
  async function pull(initial=false){
    if(pushing)return;
    try{
      const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW_ID)+'&select=data,updated_at', {headers});
      if(!r.ok) throw new Error(await r.text());
      const rows=await r.json(), row=rows?.[0];
      if(!row?.data)return;
      if(initial && !readLocal()) {writeLocal(row.data);location.reload();return;}
      if(lastRemoteUpdatedAt && row.updated_at===lastRemoteUpdatedAt)return;
      lastRemoteUpdatedAt=row.updated_at;
      const current=readLocal();
      const same=JSON.stringify(current)===JSON.stringify(row.data);
      if(!same){writeLocal(row.data);location.reload();}
    }catch(e){console.warn('Panorama Core: no se pudo leer estado remoto',e);}
  }

  const originalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    const out=originalSetItem.apply(this,arguments);
    if(this===localStorage && key===STORE && !applyingRemote){
      clearTimeout(pullTimer); pullTimer=setTimeout(push,250);
    }
    return out;
  };

  window.PanoramaCore={
    async paymentStatus(periodId,employeeId){
      const url=cfg.url+'/rest/v1/payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(String(periodId))+'&employee_id=eq.'+encodeURIComponent(String(employeeId))+'&select=id,status,amount,period_start,period_end';
      const r=await fetch(url,{headers}); if(!r.ok) throw new Error(await r.text()); return r.json();
    }
  };

  window.addEventListener('load',async()=>{
    await pull(true);
    await push();
    setInterval(()=>pull(false),5000);
    window.dispatchEvent(new Event('panorama-core-personal-ready'));
  });
})();
