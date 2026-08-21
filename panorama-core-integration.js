/* Panorama Personal <-> Panorama Café Core */
(function(){
 const cfg=window.PANORAMA_SUPABASE,STORE='panorama_cafe_personal_v1',ROW_ID='personal-main';
 if(!cfg?.url||!cfg?.key)return;
 const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
 let pushing=false,applyingRemote=false,pushTimer=null,lastRemoteUpdatedAt=null,pollTimer=null;
 const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};
 function applyRemoteState(data){
  if(!data||typeof data!=='object')return false;
  if(JSON.stringify(read())===JSON.stringify(data))return false;
  applyingRemote=true;
  try{
   /* db y renderAll pertenecen al script principal: son bindings globales del mismo documento. */
   if(typeof db!=='undefined') db=data;
   localStorage.setItem(STORE,JSON.stringify(data));
   if(typeof renderAll==='function') renderAll();
   console.info('Panorama Personal: estado remoto aplicado a interfaz activa');
   return true;
  }finally{setTimeout(()=>applyingRemote=false,0)}
 }
 async function publishPayments(data){
  const payments=Array.isArray(data?.payments)?data.payments:[],emps=new Map((data?.employees||[]).map(e=>[String(e.id),e]));
  for(const p of payments){if(!p?.id||!p?.employeeId||!Number.isFinite(Number(p.amount)))continue;const e=emps.get(String(p.employeeId))||{};const body={id:String(p.id),source:'personal',employee_id:String(p.employeeId),employee_name:String(e.name||''),amount:Number(p.amount),paid_date:String(p.paidDate).slice(0,10),period_start:p.periodStart||null,period_end:p.periodEnd||null,note:p.note||'',account:p.account||null,updated_at:new Date().toISOString()};await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?on_conflict=id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});}
 }
 async function push(){if(pushing||applyingRemote)return;const data=read();if(!data)return;pushing=true;try{const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+ROW_ID,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({data})});if(!r.ok)throw new Error(await r.text());const rows=await r.json();lastRemoteUpdatedAt=rows?.[0]?.updated_at||lastRemoteUpdatedAt;await publishPayments(data)}catch(e){console.warn('Panorama Personal sync',e)}finally{pushing=false}}
 async function pull(){try{const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+ROW_ID+'&select=data,updated_at',{headers,cache:'no-store'});if(!r.ok)throw new Error(await r.text());const row=(await r.json())?.[0];if(!row?.data)return false;if(row.updated_at===lastRemoteUpdatedAt)return false;lastRemoteUpdatedAt=row.updated_at;return applyRemoteState(row.data)}catch(e){console.warn('Panorama Personal pull',e);return false}}
 const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){const out=orig.apply(this,arguments);if(this===localStorage&&k===STORE&&!applyingRemote){clearTimeout(pushTimer);pushTimer=setTimeout(push,150)}return out};
 window.PanoramaCore={syncNow:push,pullNow:pull};
 async function start(){const changed=await pull();if(!changed&&!lastRemoteUpdatedAt)await push();if(!pollTimer)pollTimer=setInterval(pull,1500);window.dispatchEvent(new Event('panorama-core-personal-ready'))}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();