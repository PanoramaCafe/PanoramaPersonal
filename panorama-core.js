(function(){
const cfg=window.PANORAMA_SUPABASE;
if(!cfg) return;
const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',Prefer:'return=representation'};
const api=async(path,opt={})=>{const r=await fetch(cfg.url+'/rest/v1/'+path,{...opt,headers:{...headers,...(opt.headers||{})}});if(!r.ok)throw new Error(await r.text());const t=await r.text();return t?JSON.parse(t):null};
window.PanoramaCore={
 async upsertEmployee(employee){const row={id:employee.id,full_name:employee.name,active:employee.active!==false,created_by_app:'personal',updated_by_app:'personal'};return api('employees?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)})},
 async createPayrollRequest(line,period){const row={employee_id:line.employeeId,external_payroll_period_id:period.id,period_start:period.start,period_end:period.end,amount:Number(line.amount),currency:'MXN',status:'PENDING_PAYMENT',notes:'Generado desde Panorama Personal',created_by_app:'personal',updated_by_app:'personal'};return api('payroll_payment_requests',{method:'POST',body:JSON.stringify(row)})},
 async syncPayrollPeriod(period){const out=[];for(const line of period.snapshot.employees){out.push(await this.createPayrollRequest(line,period));}return out},
 async getPayrollStatus(periodId){return api('payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(periodId)+'&select=id,employee_id,amount,status,financial_payment_confirmations(amount,financial_movement_id)')}
};
})();