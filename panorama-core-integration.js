/* Panorama Core integration bootstrap */
(async()=>{
  const cfg=window.PANORAMA_SUPABASE;
  if(!cfg){console.warn('Panorama Core: missing config');return;}
  const api=cfg.url+'/rest/v1/'; const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
  async function request(path,opts={}){const r=await fetch(api+path,{...opts,headers:{...headers,...opts.headers}});if(!r.ok)throw new Error(await r.text());return r.status===204?null:r.json();}
  window.PanoramaCore={
    async syncEmployee(employee){const payload={full_name:employee.name||employee.full_name,active:employee.active!==false,created_by_app:'personal',updated_by_app:'personal'}; if(employee.core_id){const rows=await request('employees?id=eq.'+encodeURIComponent(employee.core_id),{method:'PATCH',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});return rows[0];}const rows=await request('employees',{method:'POST',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});return rows[0];},
    async createPayrollRequest(employee,amount,periodStart,periodEnd,externalId){const e=await this.syncEmployee(employee);const payload={employee_id:e.id,external_payroll_period_id:externalId,period_start:periodStart,period_end:periodEnd,amount:Number(amount),currency:'MXN',status:'PENDING_PAYMENT',created_by_app:'personal',updated_by_app:'personal'};const rows=await request('payroll_payment_requests',{method:'POST',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});return rows[0];},
    async paymentStatus(externalId){return request('payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(externalId)+'&select=*');}
  };
  window.addEventListener('panorama:payroll-finalized',async e=>{const d=e.detail;if(!d?.items)return;for(const item of d.items){await PanoramaCore.createPayrollRequest(item.employee,item.amount,d.periodStart,d.periodEnd,d.externalId);}});
})();