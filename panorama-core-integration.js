/* Panorama Personal <-> Panorama Café Core
   Estado único: Panorama Personal guarda localmente y sincroniza el mismo estado con Supabase.
   Los cambios remotos se detectan por el contenido real, no solo por updated_at.
*/
(function(){
  const cfg=window.PANORAMA_SUPABASE,STORE='panorama_cafe_personal_v1',ROW_ID='personal-main';
  if(!cfg?.url||!cfg?.key){console.warn('Panorama Personal: falta configuración Supabase');return;}

  const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
  let pushing=false,applyingRemote=false,pushTimer=null,pollTimer=null,lastRemoteSignature=null;

  const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};
  const signature=data=>{try{return JSON.stringify(data)}catch{return ''}};

  function applyRemoteState(data,updatedAt){
    if(!data||typeof data!=='object')return false;
    const remoteSignature=signature(data);
    if(remoteSignature===signature(read()))return false;

    applyingRemote=true;
    try{
      /* index.html y este archivo son scripts clásicos del mismo documento.
         db y renderAll son el estado y render oficiales de Panorama Personal. */
      db=data;
      localStorage.setItem(STORE,remoteSignature);
      renderAll();
      window.dispatchEvent(new CustomEvent('panorama-core-personal-remote-update',{detail:{data,updatedAt}}));
      console.info('Panorama Personal: cambio remoto aplicado',updatedAt||'sin timestamp');
      return true;
    }catch(error){
      console.error('Panorama Personal: no se pudo aplicar el estado remoto',error);
      return false;
    }finally{
      queueMicrotask(()=>{applyingRemote=false;});
    }
  }

  async function publishPayments(data){
    const payments=Array.isArray(data?.payments)?data.payments:[];
    const emps=new Map((Array.isArray(data?.employees)?data.employees:[]).map(e=>[String(e.id),e]));
    for(const p of payments){
      if(!p?.id||!p?.employeeId||!Number.isFinite(Number(p.amount)))continue;
      const e=emps.get(String(p.employeeId))||{};
      const body={
        id:String(p.id),source:'personal',employee_id:String(p.employeeId),employee_name:String(e.name||''),
        amount:Number(p.amount),paid_date:String(p.paidDate||'').slice(0,10)||null,
        period_start:p.periodStart||null,period_end:p.periodEnd||null,note:p.note||'',account:p.account||null,
        updated_at:new Date().toISOString()
      };
      const r=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?on_conflict=id',{
        method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)
      });
      if(!r.ok)throw new Error(await r.text());
    }
  }

  async function push(){
    if(pushing||applyingRemote)return;
    const data=read();
    if(!data)return;
    pushing=true;
    try{
      const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW_ID),{
        method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({data})
      });
      if(!r.ok)throw new Error(await r.text());
      const row=(await r.json())?.[0];
      lastRemoteSignature=signature(row?.data||data);
      await publishPayments(data);
      window.dispatchEvent(new Event('panorama-core-personal-synced'));
      console.info('Panorama Personal: cambio local sincronizado');
    }catch(error){console.warn('Panorama Personal sync',error);}
    finally{pushing=false;}
  }

  async function pull(){
    if(pushing)return false;
    try{
      const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW_ID)+'&select=data,updated_at',{
        headers:{...headers,'Cache-Control':'no-cache'},cache:'no-store'
      });
      if(!r.ok)throw new Error(await r.text());
      const row=(await r.json())?.[0];
      if(!row?.data)return false;

      const remoteSignature=signature(row.data);
      if(remoteSignature===lastRemoteSignature)return false;
      lastRemoteSignature=remoteSignature;

      return applyRemoteState(row.data,row.updated_at);
    }catch(error){console.warn('Panorama Personal pull',error);return false;}
  }

  const originalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    const result=originalSetItem.apply(this,arguments);
    if(this===localStorage&&key===STORE&&!applyingRemote){
      clearTimeout(pushTimer);
      pushTimer=setTimeout(push,100);
    }
    return result;
  };

  window.PanoramaCore={syncNow:push,pullNow:pull};

  async function start(){
    await pull();
    if(!lastRemoteSignature){await push();}
    if(!pollTimer)pollTimer=setInterval(pull,1000);
    window.dispatchEvent(new Event('panorama-core-personal-ready'));
    console.info('Panorama Personal: sincronización automática activa');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();