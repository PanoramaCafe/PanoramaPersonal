/* Panorama Core integration: Personal */
(async()=>{
  const cfg=window.PANORAMA_SUPABASE;if(!cfg)return;
  await (window.PanoramaAuth?.ready||Promise.resolve());
  const api=cfg.url+'/rest/v1/';
  async function request(path,opts={}){const h=window.PanoramaAuth?.headers?.()||{apikey:cfg.key,'Content-Type':'application/json'};const r=await fetch(api+path,{...opts,headers:{...h,...opts.headers}});const t=await r.text();if(!r.ok)throw Error(t||r.statusText);return t?JSON.parse(t):null;}
  window.PanoramaCore={async syncEmployee(employee){const p={full_name:employee.name||employee.full_name,active:employee.active!==false,created_by_app:'personal',updated_by_app:'personal'};let rows;if(employee.coreEmployeeId)rows=await request('employees?id=eq.'+encodeURIComponent(employee.coreEmployeeId),{method:'PATCH',body:JSON.stringify(p),headers:{Prefer:'return=representation'}});if(!rows?.[0])rows=await request('employees',{method:'POST',body:JSON.stringify(p),headers:{Prefer:'return=representation'}});if(rows?.[0])employee.coreEmployeeId=rows[0].id;return rows?.[0];}};
  window.renderPayrollPaymentQueue=function(){const b=document.getElementById('payrollPaymentQueue');if(b)b.innerHTML='';};window.syncCorePaymentStatuses=async function(){};
  Object.values(db.payrollPeriods||{}).forEach(p=>{if(p){delete p.coreRequests;delete p.corePaymentStatuses;delete p.paidAt;if(p.status==='paid'||p.status==='partial')p.status='finalized';}});
  try{localStorage.setItem(STORE,JSON.stringify(db));}catch{}
  if(typeof renderAdmin==='function')renderAdmin();window.dispatchEvent(new CustomEvent('panorama-core-personal-ready'));

  /* Estado compartido entre dispositivos. La UI y la lógica existente no se modifican. */
  const ENDPOINT='https://dtmhffgpwxzdncbuoohb.supabase.co/functions/v1/panorama-personal-sync-v2';
  const APIKEY='sb_publishable_S_wZkfLNvx0mnHBLGHcfgg_Q_SkycdW';
  const H={'Content-Type':'application/json','apikey':APIKEY,'Authorization':'Bearer '+APIKEY};
  let last=JSON.stringify(db),remote='',applying=false,busy=false,started=false;
  async function syncApi(method,body){const r=await fetch(ENDPOINT,{method,headers:H,cache:'no-store',body:body?JSON.stringify(body):undefined});const t=await r.text();if(!r.ok)throw Error(method+' '+r.status+' '+t);return t?JSON.parse(t):null;}
  async function upload(){const state=JSON.parse(JSON.stringify(db));await syncApi('POST',{data:{__panorama_sync:true,key:STORE,data:state}});last=JSON.stringify(db);remote=last;}
  function unpack(row){return row?.data?.__panorama_sync?row.data:null;}
  async function startSharedSync(){try{const row=await syncApi('GET');const p=unpack(row);if(p?.data){const incoming=JSON.stringify(p.data);if(incoming!==last){applying=true;db=loadFromRemote(p.data);localStorage.setItem(STORE,JSON.stringify(db));last=JSON.stringify(db);remote=last;applying=false;renderAll();}else remote=incoming;}else await upload();}catch(e){console.warn('Panorama Personal sincronización offline',e);}started=true;}
  function loadFromRemote(data){const base=blankDB();return {...base,...data,employees:Array.isArray(data.employees)?data.employees:[],sessions:Array.isArray(data.sessions)?data.sessions:[],payments:Array.isArray(data.payments)?data.payments:[],approvals:data.approvals&&typeof data.approvals==='object'?data.approvals:{},weekFinalizations:data.weekFinalizations&&typeof data.weekFinalizations==='object'?data.weekFinalizations:{},payrollPeriods:data.payrollPeriods&&typeof data.payrollPeriods==='object'?data.payrollPeriods:{},adminPin:/^\d{4}$/.test(String(data.adminPin||''))?String(data.adminPin):'1234'};}
  async function tickShared(){if(!started||busy||applying)return;busy=true;try{const now=JSON.stringify(db);if(now!==last){if(navigator.onLine){await upload();}else localStorage.setItem('__panorama_personal_pending_sync',now);}if(navigator.onLine){const row=await syncApi('GET');const p=unpack(row);if(p?.data){const incoming=JSON.stringify(p.data);if(incoming!==remote&&incoming!==JSON.stringify(db)){applying=true;db=loadFromRemote(p.data);localStorage.setItem(STORE,JSON.stringify(db));last=JSON.stringify(db);remote=last;applying=false;renderAll();}else remote=incoming;}}}catch(e){console.warn('Panorama Personal pendiente de sincronizar',e);}finally{busy=false;}}
  window.addEventListener('online',tickShared);window.addEventListener('focus',tickShared);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickShared();});setInterval(tickShared,2500);startSharedSync();
})();
