/* Panorama Personal · integración limpia con Supabase */
(async()=>{
  const cfg=window.PANORAMA_SUPABASE;
  if(!cfg) return;
  await (window.PanoramaAuth?.ready||Promise.resolve());

  const stateUrl=cfg.url+'/rest/v1/panorama_personal_state?id=eq.personal-main';
  const baseHeaders={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
  const PENDING='panorama_personal_pending_state_v1';
  let last='';
  let remoteUpdatedAt='';
  let applying=false;
  let syncing=false;

  const clone=v=>JSON.parse(JSON.stringify(v));
  const json=v=>JSON.stringify(v);

  function normalize(data){
    const base=blankDB();
    return {
      ...base,...data,
      employees:Array.isArray(data?.employees)?data.employees:[],
      sessions:Array.isArray(data?.sessions)?data.sessions:[],
      payments:Array.isArray(data?.payments)?data.payments:[],
      approvals:data?.approvals&&typeof data.approvals==='object'?data.approvals:{},
      weekFinalizations:data?.weekFinalizations&&typeof data.weekFinalizations==='object'?data.weekFinalizations:{},
      payrollPeriods:data?.payrollPeriods&&typeof data.payrollPeriods==='object'?data.payrollPeriods:{},
      adminPin:/^\d{4}$/.test(String(data?.adminPin||''))?String(data.adminPin):'1234'
    };
  }

  function saveLocal(){
    localStorage.setItem(STORE,json(db));
    last=json(db);
  }

  async function readRemote(){
    const r=await fetch(stateUrl+'&select=id,data,updated_at',{headers:baseHeaders,cache:'no-store'});
    const t=await r.text();
    if(!r.ok) throw Error(t||('GET '+r.status));
    const rows=t?JSON.parse(t):[];
    return rows[0]||null;
  }

  async function writeRemote(data){
    const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?on_conflict=id',{
      method:'POST',
      headers:{...baseHeaders,Prefer:'resolution=merge-duplicates,return=representation'},
      body:json({id:'personal-main',data,updated_at:new Date().toISOString()})
    });
    const t=await r.text();
    if(!r.ok) throw Error(t||('POST '+r.status));
    const rows=t?JSON.parse(t):[];
    return rows[0]||null;
  }

  function queue(){
    try{localStorage.setItem(PENDING,json({data:clone(db),queuedAt:Date.now()}));}catch{}
  }

  function pending(){
    try{const p=JSON.parse(localStorage.getItem(PENDING)||'null');return p?.data||null;}catch{return null;}
  }

  function clearPending(){try{localStorage.removeItem(PENDING);}catch{}}

  async function uploadCurrent(){
    const state=clone(db);
    queue();
    const row=await writeRemote(state);
    clearPending();
    last=json(db);
    remoteUpdatedAt=row?.updated_at||new Date().toISOString();
  }

  function applyRemote(row){
    if(!row?.data) return;
    const incoming=normalize(row.data);
    const incomingJson=json(incoming);
    if(incomingJson===json(db)){
      remoteUpdatedAt=row.updated_at||remoteUpdatedAt;
      last=json(db);
      return;
    }
    applying=true;
    db=incoming;
    saveLocal();
    remoteUpdatedAt=row.updated_at||remoteUpdatedAt;
    applying=false;
    if(typeof renderAll==='function') renderAll();
  }

  async function boot(){
    try{
      const row=await readRemote();
      const queued=pending();
      if(row?.data){
        applyRemote(row);
        if(queued) await uploadCurrent();
      }else if(queued){
        db=normalize(queued);
        saveLocal();
        await uploadCurrent();
      }else{
        await uploadCurrent();
      }
    }catch(e){
      queue();
      console.warn('Panorama Personal: trabajando sin conexión',e);
    }
    last=json(db);
  }

  async function tick(){
    if(syncing||applying||!navigator.onLine) return;
    syncing=true;
    try{
      const now=json(db);
      if(now!==last){
        await uploadCurrent();
      }else{
        const row=await readRemote();
        if(row?.data&&row.updated_at!==remoteUpdatedAt) applyRemote(row);
      }
    }catch(e){
      queue();
      console.warn('Panorama Personal: sincronización pendiente',e);
    }finally{
      syncing=false;
    }
  }

  /* Conserva la integración existente con Panorama Core sin alterar la UI. */
  const api=cfg.url+'/rest/v1/';
  async function request(path,opts={}){
    const h=window.PanoramaAuth?.headers?.()||baseHeaders;
    const r=await fetch(api+path,{...opts,headers:{...h,...opts.headers}});
    const t=await r.text();
    if(!r.ok) throw Error(t||r.statusText);
    return t?JSON.parse(t):null;
  }
  window.PanoramaCore={async syncEmployee(employee){
    const p={full_name:employee.name||employee.full_name,active:employee.active!==false,created_by_app:'personal',updated_by_app:'personal'};
    let rows;
    if(employee.coreEmployeeId) rows=await request('employees?id=eq.'+encodeURIComponent(employee.coreEmployeeId),{method:'PATCH',body:JSON.stringify(p),headers:{Prefer:'return=representation'}});
    if(!rows?.[0]) rows=await request('employees',{method:'POST',body:JSON.stringify(p),headers:{Prefer:'return=representation'}});
    if(rows?.[0]) employee.coreEmployeeId=rows[0].id;
    return rows?.[0];
  }};
  window.renderPayrollPaymentQueue=function(){const b=document.getElementById('payrollPaymentQueue');if(b)b.innerHTML='';};
  window.syncCorePaymentStatuses=async function(){};

  Object.values(db.payrollPeriods||{}).forEach(p=>{if(p){delete p.coreRequests;delete p.corePaymentStatuses;delete p.paidAt;if(p.status==='paid'||p.status==='partial')p.status='finalized';}});
  saveLocal();
  if(typeof renderAdmin==='function') renderAdmin();
  window.dispatchEvent(new CustomEvent('panorama-core-personal-ready'));

  window.addEventListener('online',tick);
  window.addEventListener('focus',tick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  setInterval(tick,3000);
  await boot();
})();
