/* Panorama Personal · cargador + estado compartido + Panorama Café Core */
(async()=>{
  if(!window.PanoramaCore){
    await new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src.endsWith('/panorama-core.js')||s.src.endsWith('panorama-core.js'));
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});setTimeout(resolve,50);return;}
      const s=document.createElement('script');s.src='panorama-core.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar panorama-core.js'));document.head.appendChild(s);
    }).catch(e=>console.warn(e));
  }
  const cfg=window.PANORAMA_SUPABASE;if(!cfg)return;
  await (window.PanoramaAuth?.ready||Promise.resolve());
  const stateUrl=cfg.url+'/rest/v1/panorama_personal_state?id=eq.personal-main';
  const baseHeaders={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
  const PENDING='panorama_personal_pending_state_v1';let last='',remoteUpdatedAt='',applying=false,syncing=false;
  const clone=v=>JSON.parse(JSON.stringify(v)),json=v=>JSON.stringify(v);
  function normalize(data){const base=blankDB();return {...base,...data,employees:Array.isArray(data?.employees)?data.employees:[],sessions:Array.isArray(data?.sessions)?data.sessions:[],payments:Array.isArray(data?.payments)?data.payments:[],approvals:data?.approvals&&typeof data.approvals==='object'?data.approvals:{},weekFinalizations:data?.weekFinalizations&&typeof data.weekFinalizations==='object'?data.weekFinalizations:{},payrollPeriods:data?.payrollPeriods&&typeof data.payrollPeriods==='object'?data.payrollPeriods:{},adminPin:/^\d{4}$/.test(String(data?.adminPin||''))?String(data.adminPin):'1234'};}
  function saveLocal(){localStorage.setItem(STORE,json(db));last=json(db)}
  async function readRemote(){const r=await fetch(stateUrl+'&select=id,data,updated_at',{headers:baseHeaders,cache:'no-store'});const t=await r.text();if(!r.ok)throw Error(t||('GET '+r.status));return t?JSON.parse(t)[0]||null:null}
  async function writeRemote(data){const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?on_conflict=id',{method:'POST',headers:{...baseHeaders,Prefer:'resolution=merge-duplicates,return=representation'},body:json({id:'personal-main',data,updated_at:new Date().toISOString()})});const t=await r.text();if(!r.ok)throw Error(t||('POST '+r.status));return t?JSON.parse(t)[0]||null:null}
  function queue(){try{localStorage.setItem(PENDING,json({data:clone(db),queuedAt:Date.now()}))}catch{}}
  function pending(){try{return JSON.parse(localStorage.getItem(PENDING)||'null')?.data||null}catch{return null}}
  function clearPending(){try{localStorage.removeItem(PENDING)}catch{}}
  async function uploadCurrent(){queue();const row=await writeRemote(clone(db));clearPending();last=json(db);remoteUpdatedAt=row?.updated_at||new Date().toISOString()}
  function applyRemote(row){if(!row?.data)return;const incoming=normalize(row.data);if(json(incoming)===json(db)){remoteUpdatedAt=row.updated_at||remoteUpdatedAt;last=json(db);return}applying=true;db=incoming;saveLocal();remoteUpdatedAt=row.updated_at||remoteUpdatedAt;applying=false;if(typeof renderAll==='function')renderAll()}
  async function syncEmployeesToCore(){if(!window.PanoramaCore?.syncEmployee)return;for(const employee of db.employees||[]){try{await window.PanoramaCore.syncEmployee(employee)}catch(e){console.warn('No se pudo sincronizar trabajador con Panorama Core',employee?.name,e)}}}
  async function syncFinalizedPayrollsToCore(){if(!window.PanoramaCore?.syncPayrollPeriod)return;for(const period of Object.values(db.payrollPeriods||{})){if(!period?.snapshot?.employees?.length)continue;try{await window.PanoramaCore.syncPayrollPeriod(period)}catch(e){console.warn('No se pudo sincronizar nómina con Panorama Core',period?.id,e)}}}
  async function syncCorePaymentStatuses(){if(!window.PanoramaCore?.getPayrollStatus)return;let changed=false;for(const period of Object.values(db.payrollPeriods||{})){if(!period?.id)continue;try{const rows=await window.PanoramaCore.getPayrollStatus(period.id);period.corePaymentStatuses=period.corePaymentStatuses||{};for(const row of rows||[]){const local=(db.employees||[]).find(e=>e.coreEmployeeId===row.employee_id);if(local){period.corePaymentStatuses[local.id]={id:row.id,status:row.status,amount:Number(row.amount||0),paidAt:row.financial_payment_confirmations?.[0]?.paid_at||null};changed=true}}}catch(e){console.warn('No se pudieron actualizar estados de pago',period?.id,e)}}if(changed){saveLocal();if(typeof renderAll==='function')renderAll()}}
  async function boot(){try{const row=await readRemote(),queued=pending();if(row?.data){applyRemote(row);if(queued)await uploadCurrent()}else if(queued){db=normalize(queued);saveLocal();await uploadCurrent()}else await uploadCurrent()}catch(e){queue();console.warn('Panorama Personal: trabajando sin conexión',e)}last=json(db);await syncEmployeesToCore();await syncFinalizedPayrollsToCore();await syncCorePaymentStatuses()}
  async function tick(){if(syncing||applying||!navigator.onLine)return;syncing=true;try{const now=json(db);if(now!==last)await uploadCurrent();else{const row=await readRemote();if(row?.data&&row.updated_at!==remoteUpdatedAt)applyRemote(row)}await syncEmployeesToCore();await syncFinalizedPayrollsToCore();await syncCorePaymentStatuses()}catch(e){queue();console.warn('Panorama Personal: sincronización pendiente',e)}finally{syncing=false}}
  window.renderPayrollPaymentQueue=function(){const b=document.getElementById('payrollPaymentQueue');if(b)b.innerHTML=''};window.syncCorePaymentStatuses=syncCorePaymentStatuses;window.addEventListener('online',tick);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});setInterval(tick,15000);await boot();window.dispatchEvent(new CustomEvent('panorama-core-personal-ready'));
})();
